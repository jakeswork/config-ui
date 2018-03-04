// @author: Jake Flynn jflynn@reapit.com
//
// @desc: 	Configuration UI
// 			1. Loads in an XSD file, generates form inputs using the XSD as a reference of the structure
// 			2. Loads the client's relevant XML file (e.g. webservice.xsd => webservice.xml) and populates the form inputs
// 			with their current settings
// 			3. Upon submission the old XML file is saved as a backup, and the new file takes it's place
//
// @date: 	19/12/2017

$(function() {

  // global vars
  // our schema/xml reference name
  var schemaToGet = "" + $('#configIdentifier').text().toLowerCase().replace(/\s/g, '');
  // spinny modal
  var modal = $('<div class="loadingModal spinny" style="display: block;"></div>');
  $('#RPW_acc_main').prepend(modal);

  // global functions
  // capitalise our labels
  function caps(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
  }

  // start by checking if there is an xml file that already exists
  $.ajax({
    type: "GET",
    url: "./?_action=moduleprocess&_module=Reapit\\ReapitWeb\\MVC\\Modules\\Content\\_admin\\Config\\Build&_process=getXMLConfigFile&file=" + schemaToGet + "",
    cache: false,
    success: function(responseJSON) {
      var JSONString = responseJSON.split('<')[0];

      // after we have successfuly got the XML file, grab the XSD that goes with it
      $.ajax({
        type: "GET",
        dataType: "xml",
        contentType: "text/xml; charset=\"utf-8\"",
        url: "../content/_xsd/config/" + schemaToGet + ".xsd",
        cache: false,
        success: function(xsd) {
          // empty form
          $('#configListing').empty();
          // build form based off our schema
          // make sure we update only after the form has been built
          $.when(createForm(xsd)).then(function() {
            updateForm(JSON.parse(JSONString));
            modal.css('display', 'none');
          });
        },
        error: function() {
          console.log('No such XSD exists');
        }
      });

    }
  });

  // create the form based off the schema
  function createForm(schema) {
    console.log("XSD Schema:");
    console.log(schema);

    // get our parent element at the top of the document which we can traverse from
    var parent = $(schema).children('[xmlns]');

    $(parent).children('[name]').each(function() {
      // push all of the ref attributes to the element, we will need this later for nesting
      var refs = [];
      $(this).find('xs\\:element').each(function() {
        if ($(this).attr('ref') !== undefined) {
          refs.push($(this).attr('ref'));
        }
      });
      // list out all of the elements
      $('#configListing').append('<li class="parent ' + $(this).attr('name') + '" ' + 'data-children="' + refs + '" ><label data-tagname="' + $(this).attr('name') + '">' + caps($(this).attr('name')).replace(/([a-z])([A-Z])/g, '$1 $2') + '</label><ul></ul></li>');
    });

    // append all of the inputs to each node
    parent.find('xs\\:element').each(function() {
      if ($(this).attr('name')) {
        $('.' + $(this).parents('[name]').attr('name')).children('ul').append('<li><label data-tagname="' + $(this).attr('name') + '">' + caps($(this).attr('name')).replace(/([a-z])([A-Z])/g, '$1 $2') + '</label><input type="text" data-type="' + $(this).attr("type") + '" data-min="' + $(this).attr('minOccurs') + '" data-max="' + $(this).attr('maxOccurs') + '"/></li>');
      }
    });

    // create our drop down lists based off simpleType attributes in the XSD
    (function createSimpleTypes() {
      // start by changing all of the inputs with a simple type to select elements
      parent.find('xs\\:simpleType').each(function() {

        $('[data-type=' + $(this).parent().attr('name') + ']').each(function() {
          $(this).replaceWith('<select data-type="' + $(this).attr("data-type") + '" data-min="' + $(this).attr('data-min') + '" data-max="' + $(this).attr('data-max') + '"></select>');
        });

        $(this).find('xs\\:enumeration').each(function() {
          // converting codes to names if available
          if ($(this).find('xs\\:documentation').length) {
            $('[data-type="' + $(this).parents('[name]').attr('name') + '"]').append('<option value="' + $(this).attr('value') + '">' + caps($(this).find('xs\\:documentation').text()) + '</option>');
          } else {
            $('[data-type="' + $(this).parents('[name]').attr('name') + '"]').append('<option value="' + $(this).attr('value') + '">' + caps($(this).attr('value')) + '</option>');
          }
          // specific for extensions
          if ($(this).parents('[name]').attr('name') === "extension") {
            $('.extension').children('ul').append('<li><input type="checkbox" class="extensions-array" name="config.extension.' + $(this).attr('value').replace('lib/Reapit/ReapitWeb/WebService/Extensions/', '').replace('.php', '') + '" id="' + $(this).attr('value') + '" value="' + $(this).attr('value') + ',"/><label class="inline-label">' + $(this).attr('value').replace('lib/Reapit/ReapitWeb/WebService/Extensions/', '').replace(/([a-z])([A-Z])/g, '$1 $2').replace('.php', '') + '</label></li>');
          } else {
            // remove the original element
            $('.' + $(this).parents('[name]').attr('name')).remove();
          }
        });

      });

      // keep a hidden input for the checkboxes
      $('.extension').append('<input type="hidden" id="extensions-array" data-config-setting="config.extension" name="extension"/>');

      $('.extensions-array').on('click', function() {
        var hiddenInput = $('#extensions-array');
        if ($(this).prop('checked')) {
          var getCurrent = hiddenInput.val();
          if (hiddenInput.val().indexOf(',') < 0) {
            hiddenInput.val(getCurrent + ',' + $(this).val());
          } else {
            hiddenInput.val(getCurrent + $(this).val());
          }
        } else {
          var remove = hiddenInput.val().replace($(this).val(), '');
          hiddenInput.val(remove);
        }
      })

    })();

    // nest nodes
    $('.parent').each(function() {
      var $this = $(this);

      $('.parent').each(function(i) {
        if ($this.attr('data-children').includes($(this).attr('class').split(' ')[1])) {
          $this.children('ul').append($('.' + $(this).attr('class').split(' ')[1]));
        }
      });

      if ($(this).hasClass('leadTime') || $(this).hasClass('buffer') || $(this).hasClass('duration')) {
        $(this).children('ul').remove();
        $(this).append('<input type="text" name="' + $(this).attr('class').split(' ')[1] + '" data-type="nonNegativeInteger"/>');
      }

    });

    // accomodate for extra types/cloning
    function reusableTypes(element) {
      $('.' + element).children('ul').addClass(element + 'Clone').clone(true, true).appendTo($('[data-type="' + element + '"]').parent());
      $('[data-type="' + element + '"], .' + element).remove();
    }
    reusableTypes('workingDay');
    reusableTypes('officeHours');
    reusableTypes('appointmentRequest');
    reusableTypes('userDefaults');
    reusableTypes('userPassword');
    reusableTypes('viewingSet');

    // workaround for user activation and password reset
    $('.email').find('li').clone(true).appendTo($('.userActivation').children('ul'));
    reusableTypes('userActivation');
    $('.email').find('li').clone(true).appendTo($('[data-type="passwordReset"]').parent().parent('ul'));
    $('.email').clone(true).appendTo($('[data-tagname="sales"]').next('ul'));
    $('.email').clone(true).appendTo($('[data-tagname="lettings"]').next('ul'));
    $('[data-tagname="lettings"]').next('ul').children('.email').each(function(i) {
      if (i > 0) {
        $(this).remove();
      }
    });
    $('.viewing').find('.email').remove();
    $('[data-type="passwordReset"]').parent().remove();
    $('.passwordReset').remove();

    // cloning reused elements
    $('.diary, .applicant').clone(true).appendTo($('.config').children('ul'));
    $('.appointmentRequestClone').eq(0).children().clone(true).appendTo($('.appointmentRequestClone').parent().parent());
    $('.appointmentRequestClone').eq(0).children().clone(true).appendTo($('.viewingSetClone'));
    $('.viewingSetClone').eq(0).children().clone(true).appendTo($('.viewingSetClone').parent().parent());
    $('.leadTime').eq(0).clone(true).appendTo($('.diary').children('ul'));
    $('.duration').eq(0).clone(true).appendTo($('.diary').children('ul'));
    $('.buffer').eq(0).clone(true).appendTo($('.diary').children('ul'));

    // convert to checkboxes
    $('select[data-max="unbounded"]').each(function(i) {
      var $this = $(this);
      $this.children().each(function() {
        $(this).replaceWith('<li><input class="' + $this.prev('label').attr('data-tagname') + '" type="checkbox" data-array="1" id="' + $(this).text().replace(' ', '') + '" value="' + $(this).val() + ',"/><label class="inline-label">' + $(this).text() + '</label></li>');
      });
      $this.append('<input type="hidden" id="' + $this.prev('label').attr('data-tagname') + ' "/>')
      $this.replaceWith('<ul data-type="' + $this.attr('data-type') + '" data-min="' + $this.attr('data-min') + '" data-max="' + $this.attr('data-max') + '">' + $this.html() + '</ul>');
    });

    // append checkbox selection to a hidden input that will be used
    // to convert to an array
    $('[data-array="1"]').on('click', function() {
      var hiddenInput = $(this).parent().parent().children('input[type="hidden"]');
      if ($(this).prop('checked')) {
        var getCurrent = hiddenInput.val();
        if (hiddenInput.val().indexOf(',') < 0) {
          hiddenInput.val(getCurrent + ',' + $(this).val());
        } else {
          hiddenInput.val(getCurrent + $(this).val());
        }
      } else {
        var remove = hiddenInput.val().replace($(this).val(), '');
        hiddenInput.val(remove);
      }
    });

    $('[data-tagname="config"]').removeAttr('data-tagname');

    // allow for certain elements to be cloned
    function addExtra(element) {
      var addAnother = $('<div class="addExtra">Add another</div>');
      $(element).children('ul').append(addAnother);

      addAnother.on('click', function() {
        var remove = $('<div class="removeExtra">Remove</div>');
        remove.on('click', function() {
          $(this).parent().parent().remove();
        });
        $(element).find('[data-config-setting]').each(function() {
          var dataConfig = $(this).attr('data-config-setting');
          if (dataConfig.indexOf('[]') < 1) {
            $('[data-config-setting="' + dataConfig + '"]').attr('data-config-setting', dataConfig.split('.')[0] + '[].' + dataConfig.split('.').slice(1).join('.'));
          }
        });
        $(element).clone(true).insertAfter($(this).parent().parent()).children('ul').append(remove);
      });

    }

    // set maxoccurs attributes, we'll call the above function against those that match
    $(parent).children('[name="config"]').find('xs\\:element').each(function() {
      $('.' + $(this).attr('ref')).attr('data-maxOccurs', $(this).attr('maxOccurs'));
    });

    $('[data-maxoccurs="unbounded"]').each(function() {
      // we don't want this for extensions
      if (!$(this).hasClass('extension')) {
        addExtra($(this));
      }
    });

    // sets the correct data structures needed for setting up JSON
    configureForm();

    // UI aspects of the form will go here, drop down lists, etc.
    userInterface();
  }

  function configureForm() {

    // we'll start by setting all of the input names now they have been correctly nested
    function setInputs(selector) {
      $(selector).each(function() {
        var $this = $(this);
        var location = $this.parentsUntil($this.closest('li.parent').parent().parent().parent('li.parent'), 'li').map(function() {
          return $(this).find('> label:first').attr('data-tagname');
        }).toArray().reverse().join('.');
        $this.attr({"data-config-setting": location, name: $this.prev('label').attr('data-tagname')});
      });
    }
    setInputs($('input[type="hidden"]'));
    setInputs($('select[data-type]'));

    $('input[type="text"]').each(function() {
      var $this = $(this);
      var location = $this.parentsUntil($this.closest('li.parent').parent().parent().parent('li.parent'), 'li').map(function() {
        return $(this).find('> label:first').attr('data-tagname');
      }).toArray().reverse().join('.');
      $this.attr({"data-config-setting": location, name: $this.prev('label').attr('data-tagname')});

      if ($this.attr('data-type') === "xsd:boolean" || $this.attr('data-type') === "xs:boolean") {
        $this.attr({type: 'checkbox', value: '1'});
      }
    });

    // fix for duation, buffer and lead time
    $('.leadTime, .duration, .buffer').removeClass('parent');
  }

  function userInterface() {
    // create toggle boxes for all of the subnodes
    var heightToggle = $('<div class="heightToggle"><i class="fa fa-plus"/></div>');

    heightToggle.on('click', function() {
      var $this = $(this);
      $this.toggleClass('open');
      $(this).next('ul').slideToggle(300, function() {
        if ($this.hasClass('open')) {
          $this.children('.fa').removeClass('fa-plus').addClass('fa-window-minimize');
        } else {
          $this.children('.fa').removeClass('fa-window-minimize').addClass('fa-plus');
        }
      });
    });

    var globalToggle = $('<div class="globalToggle">Open All</div>');

    globalToggle.on('click', function() {
      var $this = $(this);
      $('#configListing ul li ul').each(function() {
        if ($(this).css('display') === "none") {
          $(this).slideDown(300, function() {
            $this.text('Close All');
            $(this).prev('.heightToggle').addClass('open').children('i').removeClass('fa-plus').addClass('fa-window-minimize');
          });
        } else {
          $(this).slideUp(300, function() {
            $this.text('Open All');
            $(this).prev('.heightToggle').removeClass('open').children('i').addClass('fa-plus').removeClass('fa-window-minimize');
          });
        }
      });
    });

    $('#RPW_acc_bottom').append(globalToggle);

    $('#configListing ul li ul').each(function(i) {
      $(this).css('display', 'none');
      heightToggle.clone(true).insertBefore($(this));
    });

    // search function
    (function searchForm() {
      var searchBar = $('<div class="searchBar"><input type="text" id="searchBar" placeholder="Search"/></div>');

      // delegate our search bar event
      $('#configListing').on('keyup', '#searchBar', function() {
        var $thisVal = $(this).val().toLowerCase();

        $('[data-config-setting]').each(function() {
          if ($(this).attr('data-config-setting').toLowerCase().split('.').includes($thisVal)) {
            // added support for hidden types
            if ($(this).attr('type') === "hidden") {
              $(this).prev('ul').slideDown(300, function() {
                $(this).prev('.heightToggle').addClass('closed').children('i').removeClass('fa-plus').addClass('fa-window-minimize');
              });
            } else {
              $(this).parents('ul').slideDown(300, function() {
                $(this).prev('.heightToggle').addClass('closed').children('i').removeClass('fa-plus').addClass('fa-window-minimize');
              });
            }
          }
        });

        (function scrollToSection() {
          if ($('[data-tagname="' + $thisVal + '"]').length) {
            $('.RPW_Sub_Pan_Wrap').animate({
              scrollTop: $('.RPW_Sub_Pan_Wrap').scrollTop() + $('[data-tagname="' + $thisVal + '"]').position().top - 35
            }, 400);
            $('[data-tagname="' + $thisVal + '"]').css('color', '#108bcc').next('input').css('border', '1px solid #108bcc');
            return false;
          }
        })();

      });
      $('#configListing').prepend(searchBar);
    })();

    // arrange alphabetically
    $('#configListing').children('.parent').children('ul').children('.parent').each(function() {
      if ($(this).children('[data-tagname]').length) {
        $(this).attr('data-order', $(this).children('[data-tagname]').attr('data-tagname').charAt(0));
      }
    });

    var order = $('[data-order]').sort(function(a, b) {
      return $(a).attr('data-order') > $(b).attr('data-order')
    });
    order.appendTo($('#configListing').children('.parent').children('ul'));

    // reset all of the selects
    $('select').each(function() {
      $(this).val('');
    });

    //suggestion list on holiday ics
    function suggestionList(target, array) {
      function showList(matches, self) {
        if (self.next('.suggestionWrapper').length < 1) {
          $('<div class="suggestionWrapper"><ul class="suggestionList"></ul></div>').insertAfter(self)
        }
        var resultsArray = [];
        $.each(array, function(i) {
          if (array[i].indexOf(matches) > -1) {
            if (!resultsArray.includes(array[i])) {
              resultsArray.push(array[i])
            }
          }
        })
        if (matches.length < 1) {
          resultsArray = [];
        }
        $.each(resultsArray, function(i) {
          if ($('.' + array[i]).length < 1) {
            self.next('.suggestionWrapper').children('.suggestionList').append('<li class="suggestion ' + array[i] + '">' + array[i].toString().replace(/-/g, ' ') + '</li>')
          }
        })
        if (resultsArray.length < 1) {
          self.next('.suggestionWrapper').remove()
        }
        $('.suggestion').each(function() {
          if ($(this).text().indexOf(matches) === -1 || matches.length < 1) {
            $(this).remove()
          }
          $(this).on('click', function() {
            self.val('https://www.gov.uk/bank-holidays/' + $(this).text().toLowerCase().replace(/ /g, '-') + '.ics')
            self.next('.suggestionWrapper').remove()
          })
        })
      }

      target.keyup(function() {
        var that = $(this)
        $.each(array, function(i) {
          if (array[i].indexOf(that.val()) > -1) {
            showList(that.val(), that);
          }
        })
      })

    }
    var holidayIcsArray = ['england-and-wales', 'scotland', 'northern-ireland'];
    suggestionList($('[name="uri"]'), holidayIcsArray);
  }

  // form submission
  $('#submitConfig').on('click', function(e) {

    modal.css('display', 'block');

    e.preventDefault();

    var json = {};

    $('[data-config-setting]').each(function(index, elem) {
      // Set the pointer to the base output object
      var obj = json;
      var $that = $(this);
      //get our setting
      var key = $that.attr('data-config-setting');
      // Split the path into parts
      var keyParts = key.split('.');

      // Loop through the keyparts
      $.each(keyParts, function(index, part) {
        //we're at the end of the branch - assign value and quit
        if (index == keyParts.length - 1) {
          if ($that.attr('type') === "checkbox") {
            if ($that.prop('checked') == true) {
              obj[part] = $that.val();
            }
          } else {
            obj[part] = $that.val();
          }
          return;
        }
        // check if part is array
        match = String(part).match(/^([^\[]+)\[\]$/);
        if (match) {
          // it is an array - discard the [] from the part name
          part = match[1];
          // see if array element exists, if not create it along with its first element
          if (typeof obj[part] == 'undefined') {
            obj[part] = [];
            obj[part].push({});
          } else { // array exists - see if we can use the current element or need to create a new one
            // get a pointer to the last element in the array
            var pointer = obj[part][obj[part].length - 1];
            var elementExists = true;
            // iterate down the rest of the parts to see if the value we're trying to set already exists in the last element.
            for (var i = index + 1; i < keyParts.length; i++) {
              // if the pointer is an array, jump to its last element
              if (typeof pointer == 'array') {
                pointer = pointer[pointer.length - 1];
              }
              if (typeof pointer[keyParts[i]] == 'undefined') {
                elementExists = false;
                break;
              }
              pointer = pointer[keyParts[i]];
            }
            // The place for this value is already taken, add a new element to the  array
            if (elementExists) {
              obj[part].push({});
            }
          }
          // Point to the last element in the array
          obj = obj[part][obj[part].length - 1];
        } else if (typeof obj[part] == 'undefined') {
          // We're not dealing with an array, but we need to create the element
          obj[part] = {};
          obj = obj[part];
        } else {
          // Element already exists, move down the branch
          obj = obj[part];
        }
      });
    });

    // convert values with commas to array
    if (json) {
      function traverseObject(object) {
        // iterate through the object
        for (var i in object) {
          var value = [object[i]];
          if (!Array.isArray(object[i])) {
            // if the value contains a comma
            if (value.toString().indexOf(',') > -1 && value.toString().indexOf(' ') < 0) {
              // set the *nested* key to the
              // value as an array by splitting at the commas
              object[i] = value.toString().split(',').filter(function(el) {
                // remove the extra entry after splitting
                return el.length != 0;
              });
            }
            // if the next key exists, run again
            if (object[i] !== null && typeof(object[i]) == "object") {
              traverseObject(object[i]);
            }
          }
        }
      }
      traverseObject(json);

      function cleanObject(obj) {
        for (var i in obj) {
          if ($.isEmptyObject(obj[i])) {
            delete obj[i];
          }
          if (obj[i] !== null && typeof(obj[i]) == "object") {
            cleanObject(obj[i]);
          }
        }
      }
      cleanObject(json);
      delete json[""]
    }

    var data = {};
    data.config = JSON.stringify(json);
    data.configType = schemaToGet;
    data.returnType = 'xml';
    var url = './?_action=moduleprocess&_module=Reapit\\ReapitWeb\\MVC\\Modules\\Content\\_admin\\Config\\Build';

    $.ajax({
      type: "POST",
      url: url,
      data: data,
      dataType: "text",
      success: function(response, status, request) {
        console.log(response)
        modal.html('<h2 class="spinnyText">Your changes have been saved.</h2><h4>Download a copy of your \
				<a href="data:xml;charset=utf-8,' + encodeURI(response) + '" download="' + schemaToGet + '.xml">' + schemaToGet + '.xml</a>.</h4>').removeClass('spinny');
      }
    });

  });

  function updateForm(receivedJSON) {
    console.log('Current config JSON:');
    console.log(receivedJSON);

    // create clones of multiple occurring elements
    // for example pextra, office
    $.each(receivedJSON, function(key, value) {
      if (value.constructor === Array && key !== "extension") {
        var length = value.length;
        var $ele = $('.' + key);
        var remove = $('<div class="removeExtra">Remove</div>');
        remove.on('click', function() {
          $(this).parent().parent().remove();
        });
        if ($ele.attr('data-maxoccurs') === "unbounded") {
          for (var i = 1; i < length; i++) {
            $ele.children('ul').append(remove);
            $ele.clone(true).insertAfter($ele).children('ul').filter(function() {
              $(this).find('[data-config-setting]').each(function() {
                var dataConfig = $(this).attr('data-config-setting');
                if (dataConfig.indexOf('[]') < 1) {
                  $('[data-config-setting="' + dataConfig + '"]').attr('data-config-setting', dataConfig.split('.')[0] + '[].' + dataConfig.split('.').slice(1).join('.'));
                }
              });
              $(this).find('select').each(function() {
                $(this).val('');
              })
            });
          }

          // we don't want the remove button on the first tag
          $($ele[0]).find('.removeExtra').remove();
        }
      }
    });

    // we're going to count the amount of times our element appears in the array we have pushed to
    function countInArray(array, what) {
      var count = 0;

      for (var i = 0; i < array.length; i++) {
        if (array[i] === what) {
          count++;
        }
      }

      return count;
    }

    // populate the inputs with the relevant data in our obj
    var index = 0;
    var keysUsedArray = [];
    $('[data-config-setting]').each(function() {
      var $that = $(this);
      if ($that.attr('data-config-setting').length) {
        var leaf = 'receivedJSON.' + $that.attr('data-config-setting');
        if (leaf.indexOf('[]') < 0) {
          try {
            if (eval(leaf) !== undefined && eval(leaf).length > 0) {
              $that.val(eval(leaf));
              // support for boolean checkboxes
              if (eval(leaf) === "1") {
                $that.prop('checked', true);
              }
            }
          } catch (e) {}
        } else {
          index = countInArray(keysUsedArray, $that.attr('data-config-setting'));
          indexedLeaf = leaf.replace('[]', '[' + index + ']');
          try {
            // set the value if it exists in our data
            if (typeof eval(indexedLeaf) == 'string') {
              $that.val(eval(indexedLeaf));
            }
          } catch (e) {}
        }
        keysUsedArray.push($that.attr('data-config-setting'));
      }
    });

    //function to handle converting office codes to office names
    // in the labels
    var codes = function(array) {
      var codeToText = '';
      $('.codes').each(function() {
        if (array.includes($(this).val().split(',')[0])) {
          codeToText = $(this).attr('id');
        }
      })
      return codeToText;
    }

    // mark checkboxes after populating
    $('input[type="hidden"]').each(function() {
      var that = $(this);
      // only include hidden inputs we want
      if (that.attr('data-config-setting').length) {
        // convert the list of codes/extensions to an array
        var codesArray = that.val().split(',');
        that.parent().find('input[type="checkbox"]').each(function() {
          // tick the checkbox if its value is in the hidden input
          if (codesArray.includes($(this).val().replace(',', ''))) {
            $(this).prop('checked', true);
          }
          if ($(this).parent().parent().attr('data-type') === "officeCode") {
            $(this).parent().parent().parent().parent().parent().children('label').text('Office - ' + codes(codesArray));
          }
        });
      }
    });
    $('input[type="checkbox"]').on('click', function() {
      var codesArray = $(this).parent().parent().find('input[type="hidden"]').val().split(',');
      if ($(this).parent().parent().attr('data-type') === "officeCode") {
        $(this).parent().parent().parent().parent().parent().children('label').text('Office - ' + codes(codesArray));
      }
    });
    // show more information on the labels
    var statusCodes = $('<li class="parent status-codes"><label>Status Codes</label></li>')
    var statusCodesUl = $('<ul id="statusCodesUl" style="display: none;"></ul>')
    $('[data-tagname]').each(function() {
      var attr = $(this).attr('data-tagname')
      if (attr === "pextra") {
        $(this).text($(this).text() + ' - ' + $(this).parent().children('ul').children('li').children('[name="variable"]').val())
      }
      if (attr === "leadTime") {
        $(this).text($(this).text() + ' (hours)')
      }
      if (attr === "duration") {
        $(this).text($(this).text() + ' (minutes)')
      }
      if (attr === "buffer") {
        $(this).text($(this).text() + ' (minutes)')
      }
      if (attr === "holiday") {
        $(this).text('Custom Holidays')
      }
      // support for property statuses
      if (attr.length === 2 && attr !== 'id') {
        statusCodesUl.append($(this).parent('li'))
      }
    })
    $('.heightToggle').first().clone(true, true).appendTo(statusCodes)
    statusCodes.append(statusCodesUl)
    $('.config').children('ul').append(statusCodes)

    // display a reference to the top office diary settings at the individual
    // office levels

    // build object of the top level office properties
    function setOfficePlaceholders() {
      var topLevel = {}
      $('[data-config-setting]').each(function(i) {
        var setting = $(this).attr('data-config-setting')
        if (setting.indexOf('diary') > -1 && setting.indexOf('office') === -1 && this.value.length) {
          topLevel[setting] = this.value
          $(this).on('blur', function() {
            setOfficePlaceholders()
          })
        }
      })

      // assign the top level properties and placeholders in the office
      // inputs
      $('[data-config-setting]').each(function() {
        var setting = $(this).attr('data-config-setting')
        if (setting.indexOf('office') > -1) {
          var equiv = $(this).attr('data-config-setting').split('.').slice(1).join('.')
          if (topLevel[equiv] !== undefined) {
            var val = topLevel[equiv]
            if ($(this).attr('type') === 'text') {
              $(this).attr('placeholder', 'default: ' + val)
            }
          }
        }
      })
    }
    setOfficePlaceholders()

  }
});
